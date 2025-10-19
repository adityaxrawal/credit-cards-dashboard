import { Menu, Search } from 'lucide-react'

export default function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  return (
    <header className="flex items-center justify-between bg-white p-4 shadow-md">
      <button onClick={toggleSidebar} className="text-gray-500 focus:outline-none lg:hidden">
        <Menu className="h-6 w-6" />
      </button>
      <h1 className="text-xl font-bold">Dashboard</h1>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-64 rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>
    </header>
  )
}