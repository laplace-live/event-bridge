package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

const defaultPort = 9696

// gorilla/websocket allows only ONE concurrent writer per connection, so every
// write is funneled through the client's writePump via a buffered queue.
const (
	writeWait      = 10 * time.Second    // per-write deadline
	pongWait       = 60 * time.Second    // read deadline, refreshed on pong or any message
	pingPeriod     = (pongWait * 9) / 10 // must be less than pongWait
	sendBufferSize = 256                 // outbound queue; consumers stalled past this are dropped
)

// Client represents a connected websocket client
// Each connection can be either the chat server (IsServer == true) or a regular client
// ID has the format "server-<n>" or "client-<n>"
type Client struct {
	Conn     *websocket.Conn
	ID       string
	IsServer bool

	send      chan []byte
	done      chan struct{}
	closeOnce sync.Once
}

var (
	clients      = make(map[*websocket.Conn]*Client)
	clientsMutex sync.RWMutex
	nextID       atomic.Int64
)

var upgrader = websocket.Upgrader{
	// allow all origins; adjust if you need stricter control
	CheckOrigin: func(r *http.Request) bool { return true },
}

func main() {
	// parse cli flags
	debugFlag := flag.Bool("debug", false, "enable debug logging")
	authFlag := flag.String("auth", "", "authentication token")
	hostFlag := flag.String("host", "", "host/interface to listen on (default: localhost)")
	portFlag := flag.Int("port", defaultPort, "TCP port to listen on")
	flag.Parse()

	authToken := *authFlag
	debugMode := *debugFlag

	// host defaults to "localhost" when flag not provided
	host := *hostFlag
	if host == "" {
		host = "localhost"
	}
	port := *portFlag

	// set up zerolog global logger
	zerolog.TimeFieldFormat = time.RFC3339
	var rootLogger zerolog.Logger
	if debugMode {
		rootLogger = zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}).Level(zerolog.DebugLevel).With().Timestamp().Logger()
	} else {
		rootLogger = zerolog.New(os.Stdout).With().Timestamp().Logger()
	}
	log.Logger = rootLogger

	banner(host, port, authToken != "", debugMode)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		role, password := parseSubprotocol(r.Header.Get("Sec-WebSocket-Protocol"))
		isServer := role == "laplace-event-bridge-role-server"

		// if auth token is not in header, try query param
		if password == "" {
			password = r.URL.Query().Get("token")
		}

		if authToken != "" && password != authToken {
			log.Warn().Msgf("Authentication failed: Invalid token for %s connection", ternary(isServer, "server", "client"))
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte("Unauthorized"))
			return
		}

		// accept the same subprotocol back via the response header;
		// mutating upgrader.Subprotocols here would race across connections
		var responseHeader http.Header
		if role != "" {
			responseHeader = http.Header{"Sec-WebSocket-Protocol": {role}}
		}

		conn, err := upgrader.Upgrade(w, r, responseHeader)
		if err != nil {
			log.Error().Err(err).Msg("Upgrade error")
			return
		}

		// Get the connection URL
		scheme := "ws"
		if r.TLS != nil {
			scheme = "wss"
		}
		connectURL := fmt.Sprintf("%s://%s%s", scheme, r.Host, r.URL.Path)

		// Mask token in URL if present
		if authToken != "" && r.URL.Query().Get("token") != "" {
			connectURL += "?token=***"
		}

		idPrefix := "client"
		if isServer {
			idPrefix = "server"
		}
		clientID := fmt.Sprintf("%s-%d", idPrefix, nextID.Add(1))
		client := &Client{
			Conn:     conn,
			ID:       clientID,
			IsServer: isServer,
			send:     make(chan []byte, sendBufferSize),
			done:     make(chan struct{}),
		}

		// seed the welcome while the queue is still private: the client isn't
		// registered as a broadcast target yet, so FIFO delivers it first
		client.enqueueJSON(map[string]any{
			"type":     "established",
			"clientId": clientID,
			"isServer": isServer,
			"message":  fmt.Sprintf("Connected to LAPLACE Event Bridge: %s", connectURL),
		})

		clientsMutex.Lock()
		clients[conn] = client
		clientsMutex.Unlock()

		log.Info().Msgf("Client connected: %s%s", clientID, ternary(isServer, " (laplace-chat server)", ""))

		go client.writePump()
		go client.readPump(debugMode)
	})

	addr := host + ":" + strconv.Itoa(port)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal().Err(err).Msg("Failed to start server")
	}
}

// close marks the client dead and closes the socket; safe to call from any
// goroutine. It never takes clientsMutex — unregistration is readPump's job,
// which runs exactly once for every registered client.
func (c *Client) close() {
	c.closeOnce.Do(func() {
		close(c.done)
		c.Conn.Close()
	})
}

// enqueue hands a message to writePump without ever blocking the caller
func (c *Client) enqueue(msg []byte) {
	select {
	case <-c.done:
	case c.send <- msg:
	default:
		log.Warn().Msgf("Dropping slow client %s (send buffer full)", c.ID)
		c.close()
	}
}

func (c *Client) enqueueJSON(v any) {
	data, err := json.Marshal(v)
	if err != nil {
		return
	}
	c.enqueue(data)
}

// writePump is the only goroutine allowed to write to the connection; it also
// pings the peer so half-open connections get reaped by the read deadline
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.close()
	}()

	for {
		select {
		case msg := <-c.send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			if err := c.Conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(writeWait)); err != nil {
				return
			}
		case <-c.done:
			// best-effort close frame so browsers see a clean shutdown instead of 1006
			_ = c.Conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(writeWait))
			return
		}
	}
}

// refreshReadDeadline extends the read deadline, marking the peer live for
// another pongWait after a pong or any message
func (c *Client) refreshReadDeadline() error {
	return c.Conn.SetReadDeadline(time.Now().Add(pongWait))
}

// readPump processes messages for a single websocket connection
func (c *Client) readPump(debug bool) {
	defer func() {
		c.close()
		clientsMutex.Lock()
		delete(clients, c.Conn)
		clientsMutex.Unlock()
		log.Info().Msgf("Client disconnected: %s%s", c.ID, ternary(c.IsServer, " (laplace-chat server)", ""))
	}()

	_ = c.refreshReadDeadline()
	c.Conn.SetPongHandler(func(string) error {
		return c.refreshReadDeadline()
	})

	for {
		_, msg, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Warn().Err(err).Msgf("Read error from %s", c.ID)
			}
			break
		}
		_ = c.refreshReadDeadline()

		processMessage(c, msg, debug)
	}
}

func processMessage(sender *Client, msg []byte, debug bool) {
	clientID := sender.ID
	isServer := sender.IsServer

	var parsed map[string]any
	broadcast := make(map[string]any)

	if err := json.Unmarshal(msg, &parsed); err == nil {
		// parsed as JSON
		if debug {
			log.Debug().Msgf("Received %v from %s: %v", parsed["type"], clientID, parsed)
		} else {
			if t, ok := parsed["type"].(string); ok {
				log.Info().Msgf("Received %s from %s", t, clientID)
			} else {
				log.Info().Msgf("Received JSON from %s", clientID)
			}
		}

		for k, v := range parsed {
			broadcast[k] = v
		}
		broadcast["source"] = clientID
	} else {
		// treat as plain text
		text := string(msg)
		log.Info().Msgf("Received message from %s: %s", clientID, text)
		broadcast = map[string]any{
			"type":      "unknown-message",
			"text":      text,
			"source":    clientID,
			"timestamp": time.Now().UnixMilli(),
		}
	}

	broadcastBytes, _ := json.Marshal(broadcast)

	if isServer {
		// broadcast to all clients except sender; snapshot under the lock and
		// enqueue outside it, so a slow-client drop (enqueue → close) never
		// runs while holding clientsMutex
		clientsMutex.RLock()
		targets := make([]*Client, 0, len(clients))
		for conn, info := range clients {
			if conn == sender.Conn {
				continue
			}
			targets = append(targets, info)
		}
		clientsMutex.RUnlock()

		for _, target := range targets {
			target.enqueue(broadcastBytes)
			if debug {
				log.Debug().Msgf("Sent message to %s", target.ID)
			}
		}

		// confirmation back to server
		sender.enqueueJSON(map[string]any{
			"type":        "broadcast-success",
			"clientCount": len(targets),
			"timestamp":   time.Now().UnixMilli(),
		})
	} else {
		// echo back acknowledgement
		sender.enqueueJSON(map[string]any{
			"type":      "client-message-received",
			"message":   "Message received (client-to-server messages are not relayed)",
			"timestamp": time.Now().UnixMilli(),
		})
	}
}

// helper functions
func banner(host string, port int, authEnabled, debug bool) {
	fmt.Println("🌸 LAPLACE Event Bridge Server")
	fmt.Printf("🚀 Server running at http://%s:%d\n", host, port)
	fmt.Printf("🔐 Authentication: %s\n", ternary(authEnabled, "✅ Enabled", "❌ Disabled"))
	fmt.Printf("🐛 Debug Mode: %s\n", ternary(debug, "✅ Enabled", "❌ Disabled"))
	fmt.Printf("⏱️  Started at: %s\n", time.Now().Format(time.RFC1123))
	fmt.Println("\nWaiting for connections...")
}

func parseSubprotocol(header string) (role, password string) {
	if header == "" {
		return "", ""
	}
	parts := strings.Split(header, ",")
	role = strings.TrimSpace(parts[0])
	if len(parts) > 1 {
		password = strings.TrimSpace(parts[1])
	}
	return
}

// javascript-like ternary helper
func ternary(cond bool, a, b string) string {
	if cond {
		return a
	}
	return b
}
