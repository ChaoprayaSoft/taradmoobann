import { NextResponse } from "next/server";
import { adminDb, adminMessaging } from "@/lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { sendNotificationToUser } from "@/lib/sendNotification";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const shopId = url.searchParams.get("shopId");

    // If no shopId is provided, assume it's a Shopper wanting all their chats
    if (!shopId) {
      const chatsSnapshot = await adminDb.collection("shop_chats")
        .where("shopperEmail", "==", session.user.email)
        .get();

      let chats: any[] = chatsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      chats = chats.filter((c: any) => !c.deletedByShopper);
      
      chats.sort((a: any, b: any) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });

      // Attach shop names
      const shopIds = Array.from(new Set(chats.map(c => c.shopId)));
      if (shopIds.length > 0) {
        // Need to batch if there are many shops, but usually < 30
        const shopsSnapshot = await adminDb.collection("shops").where("id", "in", shopIds.slice(0, 30)).get();
        const shopNames: { [key: string]: string } = {};
        shopsSnapshot.docs.forEach((doc: any) => {
          shopNames[doc.id] = doc.data().name;
        });
        
        chats = chats.map(c => ({
          ...c,
          shopName: shopNames[c.shopId] || "Unknown Shop"
        }));
      }

      return NextResponse.json(chats);
    }

    const shopDoc = await adminDb.collection("shops").doc(shopId).get();
    if (!shopDoc.exists) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    const isShopOwner = shopDoc.data()?.ownerEmail === session.user.email;

    if (isShopOwner) {

      // Shop owner fetching all their customer chats
      const chatsSnapshot = await adminDb.collection("shop_chats")
        .where("shopId", "==", shopId)
        .get();

      let chats: any[] = chatsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      chats = chats.filter((c: any) => !c.deletedByShopOwner);
      
      // Sort in memory to avoid needing a Firestore composite index
      chats.sort((a: any, b: any) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });

      // Mark as read for shop owner if they are requesting a specific shopper chat
      const shopperEmail = url.searchParams.get("shopperEmail");
      if (shopperEmail) {
        const specificChat = chats.find(c => c.shopperEmail === shopperEmail);
        if (specificChat && specificChat.unreadByShopOwner) {
          await adminDb.collection("shop_chats").doc(specificChat.id).update({
            unreadByShopOwner: false
          });
        }
      }

      return NextResponse.json(chats);
    } else {
      // Shopper fetching their specific chat with the shop
      const chatId = `${shopId}_${session.user.email}`;
      const chatDoc = await adminDb.collection("shop_chats").doc(chatId).get();

      if (!chatDoc.exists) {
        return NextResponse.json({ messages: [] });
      }

      // Mark as read for shopper
      if (chatDoc.data()?.unreadByShopper) {
        await chatDoc.ref.update({ unreadByShopper: false });
      }

      return NextResponse.json(chatDoc.data());
    }
  } catch (error) {
    console.error("Error fetching shop chat:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { shopId, shopperEmail, text } = await req.json();

    if (!shopId || !text) {
      return NextResponse.json({ error: "shopId and text are required" }, { status: 400 });
    }

    // Verify shop exists
    const shopDoc = await adminDb.collection("shops").doc(shopId).get();
    if (!shopDoc.exists) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    const shopOwnerEmail = shopDoc.data()?.ownerEmail;
    
    // Check if the current user is the owner of this specific shop
    const isShopOwner = shopOwnerEmail === session.user.email;

    // Determine the shopper's email for the chat ID
    // If a shop owner is replying, they must specify the shopperEmail.
    // If a shopper is messaging, their own email is used.
    const targetShopperEmail = isShopOwner ? shopperEmail : session.user.email;
    if (!targetShopperEmail) {
      return NextResponse.json({ error: "shopperEmail is required" }, { status: 400 });
    }

    const chatId = `${shopId}_${targetShopperEmail}`;
    const chatRef = adminDb.collection("shop_chats").doc(chatId);

    const chatDoc = await chatRef.get();
    const newMessage = {
      text,
      sender: isShopOwner ? "shop_owner" : "shopper",
      timestamp: new Date().toISOString()
    };

    if (!chatDoc.exists) {
      // Must be a shopper initiating the first message since owner can only reply to existing
      // Allow either shopper or owner to initiate chat
      
      await chatRef.set({
        shopId,
        shopOwnerEmail,
        shopperEmail: targetShopperEmail,
        messages: [newMessage],
        unreadByShopOwner: true,
        unreadByShopper: false,
        updatedAt: new Date().toISOString(),
        deletedByShopper: false,
        deletedByShopOwner: false
      });
    } else {
      const existingData = chatDoc.data();
      const messages = existingData?.messages || [];
      messages.push(newMessage);

      await chatRef.update({
        messages,
        unreadByShopOwner: !isShopOwner,
        unreadByShopper: isShopOwner,
        updatedAt: new Date().toISOString(),
        deletedByShopper: false,
        deletedByShopOwner: false
      });
    }

    // Send Push & Email Notification
    try {
      const recipientEmail = isShopOwner ? targetShopperEmail : shopOwnerEmail;
      const senderName = isShopOwner ? shopDoc.data()?.name : session.user.name || "Shopper";
      
      await sendNotificationToUser(
        recipientEmail,
        { key: "Notifications.newChatMessageTitle", params: { sender: senderName } },
        text, // send raw text as body
        { url: isShopOwner ? "/shopper" : "/shop-owner", shopId }
      );
    } catch (pushError: any) {
      console.error("Failed to send notification:", pushError);
    }

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error) {
    console.error("Error sending shop chat:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user as any).roles || [];
    const isShopOwner = roles.includes("shop_owner");

    const { chatId, shopId } = await req.json();

    if (!chatId) {
      return NextResponse.json({ error: "chatId is required" }, { status: 400 });
    }

    const chatDoc = await adminDb.collection("shop_chats").doc(chatId).get();
    if (!chatDoc.exists) {
      return NextResponse.json({ success: true }); // Already gone
    }

    const chatData = chatDoc.data();

    // Verification
    let shouldDelete = false;
    let updateData: any = {};

    if (chatData?.shopperEmail === session.user.email) {
      // Shopper owns this chat
      if (chatData.deletedByShopOwner) {
        shouldDelete = true;
      } else {
        updateData.deletedByShopper = true;
      }
    } else if (isShopOwner && chatData?.shopId === shopId) {
      // Verify shop ownership
      const shopDoc = await adminDb.collection("shops").doc(shopId).get();
      if (shopDoc.exists && shopDoc.data()?.ownerEmail === session.user.email) {
        if (chatData?.deletedByShopper) {
          shouldDelete = true;
        } else {
          updateData.deletedByShopOwner = true;
        }
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (shouldDelete) {
      await chatDoc.ref.delete();
    } else {
      await chatDoc.ref.update(updateData);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shop chat:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
