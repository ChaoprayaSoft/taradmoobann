import { MetadataRoute } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

export const revalidate = 3600; // revalidate at most every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://taradmoobann.com';
  
  // Base static routes
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/en`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/th`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/en/shopping`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/th/shopping`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  try {
    // Fetch active markets from Firestore
    const marketsSnapshot = await adminDb.collection('markets').where('status', '==', 'open').get();
    
    marketsSnapshot.docs.forEach((doc: any) => {
      const marketId = doc.id;
      // Add english version
      routes.push({
        url: `${baseUrl}/en/market/${marketId}`,
        lastModified: new Date(),
        changeFrequency: 'always',
        priority: 0.9,
      });
      // Add thai version
      routes.push({
        url: `${baseUrl}/th/market/${marketId}`,
        lastModified: new Date(),
        changeFrequency: 'always',
        priority: 0.9,
      });
    });
  } catch (error) {
    console.error("Error generating sitemap:", error);
  }

  return routes;
}
