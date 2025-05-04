import { Title } from "@solidjs/meta";
import EventList from "../components/EventList";

export default function Home() {
  return (
    <>
      <Title>SolidStart + LAPLACE Event Bridge</Title>
      <main>
        <div class="container">
          <h1>SolidStart + LAPLACE Event Bridge</h1>
          <p>A simple demo showing live events from LAPLACE.live</p>

          <EventList />
        </div>
      </main>
    </>
  );
}
