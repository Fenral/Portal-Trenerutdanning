import Link from "next/link";

export default function StudentPage() {
  return (
    <main id="main-content">
      <h1>Tilgangen er aktivert</h1>
      <p>Du er nå klar til å gå inn i læringsløpet.</p>
      <Link href="/">Gå til forsiden</Link>
    </main>
  );
}
