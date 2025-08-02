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
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

const defaultPort = 9696

// Client represents a connected websocket client
// Each connection can be either the chat server (IsServer == true) or a regular client
// ID has the format "server-<n>" or "client-<n>"
type Client struct {
	Conn     *websocket.Conn
	ID       string
	IsServer bool
}

var (
	clients      = make(map[*websocket.Conn]*Client)
	clientsMutex sync.RWMutex
	nextID       = 1
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

		// accept same subprotocol back
		if role != "" {
			upgrader.Subprotocols = []string{role}
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Error().Err(err).Msg("Upgrade error")
			return
		}

		clientsMutex.Lock()
		idPrefix := "client"
		if isServer {
			idPrefix = "server"
		}
		clientID := fmt.Sprintf("%s-%d", idPrefix, nextID)
		nextID++
		client := &Client{Conn: conn, ID: clientID, IsServer: isServer}
		clients[conn] = client
		clientsMutex.Unlock()

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

		// send welcome message
		sendJSON(conn, map[string]any{
			"type":     "established",
			"clientId": clientID,
			"isServer": isServer,
			"message":  fmt.Sprintf("Connected to LAPLACE Event Bridge: %s", connectURL),
		})

		go handleConnection(client, debugMode)
	})

	addr := host + ":" + strconv.Itoa(port)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal().Err(err).Msg("Failed to start server")
	}
}

// handleConnection processes messages for a single websocket connection
func handleConnection(c *Client, debug bool) {
	conn := c.Conn
	defer func() {
		conn.Close()
		clientsMutex.Lock()
		delete(clients, conn)
		clientsMutex.Unlock()
		log.Info().Msgf("Client disconnected: %s%s", c.ID, ternary(c.IsServer, " (laplace-chat server)", ""))
	}()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Warn().Err(err).Msgf("Read error from %s", c.ID)
			}
			break
		}

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
		// broadcast to all clients except sender
		clientsMutex.RLock()
		for conn, info := range clients {
			if conn == sender.Conn {
				continue
			}
			_ = conn.WriteMessage(websocket.TextMessage, broadcastBytes)
			if debug {
				log.Debug().Msgf("Sent message to %s", info.ID)
			}
		}
		clientsMutex.RUnlock()

		// confirmation back to server
		sendJSON(sender.Conn, map[string]any{
			"type":        "broadcast-success",
			"clientCount": numClients() - 1,
			"timestamp":   time.Now().UnixMilli(),
		})
	} else {
		// echo back acknowledgement
		sendJSON(sender.Conn, map[string]any{
			"type":      "client-message-received",
			"message":   "Message received (client-to-server messages are not relayed)",
			"timestamp": time.Now().UnixMilli(),
		})
	}
}

// helper functions
func sendJSON(conn *websocket.Conn, v any) {
	data, _ := json.Marshal(v)
	_ = conn.WriteMessage(websocket.TextMessage, data)
}

func numClients() int {
	clientsMutex.RLock()
	defer clientsMutex.RUnlock()
	return len(clients)
}

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
