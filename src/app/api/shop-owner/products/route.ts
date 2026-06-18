import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from 'firebase-admin/firestore';

async function verifyShopOwnership(shopId: string, userEmail: string, roles: string[]) {
  const shopRef = adminDb.collection("shops").doc(shopId);
  const shopDoc = await shopRef.get();
  
  if (!shopDoc.exists) return { error: "Shop not found", status: 404 };
  
  const shopData = shopDoc.data();
  if (shopData?.ownerEmail !== userEmail && !roles.includes("admin")) {
    return { error: "You do not own this shop.", status: 403 };
  }
  
  return { shopDoc, shopData };
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    const roles = (session?.user as any)?.roles || [];
    if (!userEmail || (!roles.includes("shop_owner") && !roles.includes("admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description, price, imageUrls, tags, shopId, options } = await req.json();
    const parsedPrice = parseFloat(price);
    if (!name || isNaN(parsedPrice) || parsedPrice < 0 || !shopId) {
      return NextResponse.json({ error: "Missing required fields or invalid price" }, { status: 400 });
    }

    const verification = await verifyShopOwnership(shopId, userEmail, roles);
    if (verification.error) return NextResponse.json({ error: verification.error }, { status: verification.status });

    if (verification.shopData?.status === "pending") {
      return NextResponse.json({ error: "Your shop is pending approval." }, { status: 403 });
    }

    // Check product count
    const productsQuery = await adminDb.collection("products").where("shopId", "==", shopId).get();
    const productCount = productsQuery.size;
    let cost = 0;
    let userDoc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | null = null;


    const maxProductSlots = verification.shopData?.maxProductSlots || 1;

    if (productCount >= maxProductSlots) {
      cost = 5;
      const usersSnapshot = await adminDb.collection("users").where("email", "==", userEmail).limit(1).get();
      if (usersSnapshot.empty) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      userDoc = usersSnapshot.docs[0];
      const currentCoins = userDoc.data().coins || 0;
      if (currentCoins < cost) {
        return NextResponse.json({ 
          error: `You have reached the maximum of ${maxProductSlots} product slots. It costs 5 coins to unlock another slot. Insufficient coins.`, 
          code: "INSUFFICIENT_COINS" 
        }, { status: 400 });
      }
    }

    const productRef = adminDb.collection("products").doc();
    let parsedTags: string[] = [];
    if (tags && typeof tags === "string") {
      parsedTags = tags.split(",").map(t => t.trim()).filter(t => t !== "");
    }

    const productData = {
      id: productRef.id,
      shopId,
      name,
      description: description || "",
      price: parsedPrice,
      imageUrls: imageUrls || [],
      tags: parsedTags,
      options: options || [],
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (cost > 0 && userDoc) {
      const batch = adminDb.batch();
      
      // Deduct coins
      batch.update(userDoc.ref, {
        coins: FieldValue.increment(-cost)
      });
      
      // Add transaction
      const txRef = adminDb.collection("transactions").doc();
      batch.set(txRef, {
        id: txRef.id,
        userId: userDoc.id,
        userEmail: userEmail,
        type: "product_slot_fee",
        amount: -cost,
        description: `Fee for unlocking product slot #${maxProductSlots + 1} for shop`,
        relatedProductId: productRef.id,
        shopId: shopId,
        createdAt: new Date().toISOString(),
      });

      // Add product
      batch.set(productRef, productData);

      // Increment shop product slots
      if (verification.shopDoc) {
        batch.update(verification.shopDoc.ref, {
          maxProductSlots: Math.max(maxProductSlots, productCount) + 1
        });
      }
      
      await batch.commit();
    } else {
      await productRef.set(productData);
    }

    return NextResponse.json({ success: true, productId: productRef.id });
  } catch (error: any) {
    console.error("Failed to create product:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    const roles = (session?.user as any)?.roles || [];
    if (!userEmail || (!roles.includes("shop_owner") && !roles.includes("admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId, name, description, price, imageUrls, tags, shopId, options, isAvailable, action } = await req.json();
    
    // If it's just a toggle availability action
    if (action === "toggleAvailability") {
      if (!productId || !shopId || typeof isAvailable !== "boolean") {
        return NextResponse.json({ error: "Missing required fields for availability toggle" }, { status: 400 });
      }

      const verification = await verifyShopOwnership(shopId, userEmail, roles);
      if (verification.error) return NextResponse.json({ error: verification.error }, { status: verification.status });

      const productRef = adminDb.collection("products").doc(productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists || productDoc.data()?.shopId !== shopId) {
         return NextResponse.json({ error: "Product not found or access denied" }, { status: 404 });
      }

      await productRef.update({
        isAvailable,
        updatedAt: new Date().toISOString()
      });
      return NextResponse.json({ success: true, isAvailable });
    }

    const parsedPrice = parseFloat(price);
    if (!productId || !name || isNaN(parsedPrice) || parsedPrice < 0 || !shopId) {
      return NextResponse.json({ error: "Missing required fields or invalid price" }, { status: 400 });
    }

    const verification = await verifyShopOwnership(shopId, userEmail, roles);
    if (verification.error) return NextResponse.json({ error: verification.error }, { status: verification.status });

    const productRef = adminDb.collection("products").doc(productId);
    const productDoc = await productRef.get();
    if (!productDoc.exists || productDoc.data()?.shopId !== shopId) {
       return NextResponse.json({ error: "Product not found or access denied" }, { status: 404 });
    }

    let parsedTags: string[] = [];
    if (tags && typeof tags === "string") {
      parsedTags = tags.split(",").map(t => t.trim()).filter(t => t !== "");
    } else if (Array.isArray(tags)) {
      parsedTags = tags;
    }

    const updateData: any = {
      name,
      description: description || "",
      price: parsedPrice,
      tags: parsedTags,
      options: options || [],
      updatedAt: new Date().toISOString(),
    };

    if (imageUrls !== undefined) {
       updateData.imageUrls = imageUrls;
    }

    await productRef.update(updateData);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to update product:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    const roles = (session?.user as any)?.roles || [];
    if (!userEmail || (!roles.includes("shop_owner") && !roles.includes("admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    const shopId = url.searchParams.get("shopId");
    
    if (!productId || !shopId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const verification = await verifyShopOwnership(shopId, userEmail, roles);
    if (verification.error) return NextResponse.json({ error: verification.error }, { status: verification.status });

    const productRef = adminDb.collection("products").doc(productId);
    const productDoc = await productRef.get();
    if (!productDoc.exists || productDoc.data()?.shopId !== shopId) {
       return NextResponse.json({ error: "Product not found or access denied" }, { status: 404 });
    }

    await productRef.delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete product:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
