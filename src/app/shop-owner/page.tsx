export default function ShopOwnerDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shop Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage your products and active orders.</p>
        </div>
        <button className="bg-brand-600 text-white px-4 py-2 rounded-md font-medium hover:bg-brand-700 transition">
          + Add Product
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Incoming Orders</h2>
          <div className="text-gray-500 text-sm">
            No active orders right now.
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Your Products</h2>
          <div className="text-gray-500 text-sm">
            You haven't added any products yet.
          </div>
        </div>
      </div>
    </div>
  )
}
