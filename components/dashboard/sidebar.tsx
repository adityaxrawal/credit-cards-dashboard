import { Bell, CreditCard, Home, Settings, X } from 'lucide-react'

export default function Sidebar({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 p-6 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-8 w-8 text-white" />
          <h1 className="text-2xl font-bold text-white">My Bank</h1>
        </div>
      </div>
      <nav className="mt-12">
        <ul>
          <li>
            <a href="#" className="flex items-center gap-3 rounded-lg bg-gray-700 px-3 py-2 text-white">
              <Home className="h-5 w-5" />
              <span>Home</span>
            </a>
          </li>
          <li className="mt-4">
            <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-400 hover:bg-gray-700 hover:text-white">
              <CreditCard className="h-5 w-5" />
              <span>Cards</span>
            </a>
          </li>
          <li className="mt-4">
            <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-400 hover:bg-gray-700 hover:text-white">
              <Bell className="h-5 w-5" />
              <span>Notifications</span>
            </a>
          </li>
          <li className="mt-4">
            <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-400 hover:bg-gray-700 hover:text-white">
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </a>
          </li>
        </ul>
      </nav>
    </aside>
  )
}