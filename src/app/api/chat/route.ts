import { NextResponse } from "next/server";
import { adminDb, adminMessaging } from "@/lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const targetEmail = url.searchParams.get("email");
    const roles = (session.user as any).roles || [];
    const isAdmin = roles.includes("admin");

    // If an admin requests a specific chat, use that email, otherwise use the logged-in user's email
    const emailToFetch = isAdmin && targetEmail ? targetEmail : session.user.email;

    const chatDoc = await adminDb.collection("chats").doc(emailToFetch).get();
    
    if (!chatDoc.exists) {
      return NextResponse.json({ messages: [], unreadByUser: false, unreadByAdmin: false });
    }

    const checkOnly = url.searchParams.get("checkOnly") === "true";

    // Mark as read if we are actually opening the chat
    if (!checkOnly) {
      if (isAdmin) {
        await chatDoc.ref.update({ unreadByAdmin: false });
      } else {
        await chatDoc.ref.update({ unreadByUser: false });
      }
    }

    return NextResponse.json(chatDoc.data());
  } catch (error) {
    console.error("Error fetching chat:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user as any).roles || [];
    const isAdmin = roles.includes("admin");
    const { text, targetEmail } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }

    // If admin is replying, they must specify targetEmail. Otherwise it's the user's own email.
    const chatEmail = isAdmin && targetEmail ? targetEmail : session.user.email;

    const chatRef = adminDb.collection("chats").doc(chatEmail);
    const chatDoc = await chatRef.get();

    const newMessage = {
      text,
      sender: isAdmin && targetEmail ? "admin" : "user",
      timestamp: new Date().toISOString()
    };

    if (!chatDoc.exists) {
      await chatRef.set({
        userEmail: chatEmail,
        messages: [newMessage],
        unreadByAdmin: !isAdmin,
        unreadByUser: isAdmin,
        updatedAt: new Date().toISOString()
      });
    } else {
      const existingData = chatDoc.data();
      const messages = existingData?.messages || [];
      messages.push(newMessage);

      await chatRef.update({
        messages,
        unreadByAdmin: !isAdmin,
        unreadByUser: isAdmin,
        updatedAt: new Date().toISOString()
      });
    }

    // Send Push Notification
    try {
      // If admin sent message, recipient is user. If user sent message, recipient is admin.
      // Wait, there might be multiple admins. We'll find all users with 'admin' role if user sent it.
      // For now, if admin replies, recipient is the user.
      const recipients = [];
      if (isAdmin) {
        recipients.push(chatEmail);
      } else {
        const adminsSnapshot = await adminDb.collection("users").where("roles", "array-contains", "admin").get();
        adminsSnapshot.docs.forEach(doc => recipients.push(doc.id));
      }

      const senderName = isAdmin ? "Admin" : session.user.name || "User";
      
      for (const email of recipients) {
        const recipientDoc = await adminDb.collection("users").doc(email).get();
        const fcmToken = recipientDoc.data()?.fcmToken;
        if (fcmToken) {
          await adminMessaging.send({
            token: fcmToken,
            notification: {
              title: `New message from ${senderName}`,
              body: text,
            },
            data: {
              url: isAdmin ? "/" : "/admin",
              type: "chat"
            }
          });
        }
      }
    } catch (pushError: any) {
      console.error("Failed to send push notification:", pushError);
      try {
        const fs = require('fs');
        fs.writeFileSync('push-error.log', pushError.toString() + '\\n' + (pushError.stack || ''));
      } catch(e){}
    }

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error) {
    console.error("Error sending chat:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
