import Link from "next/link"

export default function Home() {
  return (
    <main className="h-screen w-full grid grid-cols-1 md:grid-cols-2 px-10 items-center justify-center bg-background">
      <div className="flex flex-col items-start justify-center">
        <h1 className="text-[5rem] md:text-[10rem] mb-0 inter font-semibold bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent w-full text-center md:text-start">SARA</h1>
        <p className="text-sm md:text-xl text-muted-foreground mb-8 max-w-2xl text-center md:text-start">
          A powerful dashboard creation tool that helps you visualize and analyze your data through customizable charts, tables, and interactive visualizations. Build, save, and share your insights effortlessly.
        </p>
      </div>
      <div className="flex gap-10 flex-col justify-end   ">
        <Link href="/dashboard?edit=true">
          <button className="px-6 py-3 w-full bg-gradient-to-r from-green-800 to-green-500 text-white rounded-lg text-lg shadow hover:bg-blue-700 transition">Generate Queries</button>
        </Link>
        <Link href="/dashboard">
          <button className="px-6 py-3 w-full bg-gray-200 text-black rounded-lg text-lg shadow hover:bg-black hover:text-green-500 hover:border-green-500 border-2 border-black transition">View Saved Dashboards</button>
        </Link>
      </div>
    </main>
  )
}
