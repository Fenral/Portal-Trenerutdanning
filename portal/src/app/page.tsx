import Link from "next/link";

export default function Home() {
  return (
    <main id="main-content">
      <h1>Trenerutdanning</h1>
      <nav aria-label="Demo-roller">
        <Link href="/test-login?as=student-selma">Student</Link>
        <Link href="/test-login?as=teacher-t3">Lærer</Link>
        <Link href="/test-login?as=admin">Administrator</Link>
      </nav>
    </main>
  );
}
