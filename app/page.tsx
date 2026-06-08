import Hero from "./components/hero";
import Projects from "./components/projects";
import Footer from "./components/footer";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="mx-auto w-full max-w-6xl px-6 flex-1">
        <Hero />
        <Projects />
      </main>
      <Footer />
    </div>
  );
}
