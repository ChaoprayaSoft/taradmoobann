export default function ShopperDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Orders & Favorites</h1>
        <p className="text-gray-500 mt-1">Track your active orders and find your favorite shops.</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4 text-brand-600">Active Order Status</h2>
        <div className="bg-brand-50 border border-brand-100 rounded-md p-4 text-brand-900">
          <p className="text-sm">You do not have any active orders currently. Go explore the market!</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Favorite Shops</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200">
            No Favorites
          </div>
        </div>
      </div>
    </div>
  )
}
