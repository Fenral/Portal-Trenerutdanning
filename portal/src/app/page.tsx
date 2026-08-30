import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Trenerutdanning</h1>
      <nav aria-label="Demo-roller">
        <Link href="/student">Student</Link>
        <Link href="/teacher">Lærer</Link>
        <Link href="/admin">Administrator</Link>
      </nav>
    </main>
  );
}
