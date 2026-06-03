export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage all markets, shops, and users.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Total Markets</h2>
          <p className="text-4xl font-bold text-brand-600 mt-2">0</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Total Users</h2>
          <p className="text-4xl font-bold text-brand-600 mt-2">0</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Total Shops</h2>
          <p className="text-4xl font-bold text-brand-600 mt-2">0</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Recent Activity Logs</h3>
        </div>
        <div className="p-6 text-center text-gray-500">
          No activities found yet.
        </div>
      </div>
    </div>
  )
}
