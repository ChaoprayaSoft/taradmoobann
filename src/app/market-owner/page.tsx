export default function MarketOwnerDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Market Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage your market, approve shops, and view members.</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Pending Shop Approvals</h2>
        <div className="text-sm text-gray-500">
          No pending shops to approve.
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Active Shops</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border rounded-md p-4 bg-gray-50">
              <p className="text-gray-500 text-sm italic">Your approved shops will appear here.</p>
            </div>
        </div>
      </div>
    </div>
  )
}
