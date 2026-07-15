import { supabase } from "@/lib/supabase";

const VAPID_PUBLIC_KEY =
  "BJGPULO1LdR7duuD0XAk-J3gc2LJvPiWxTtruty7zstuGEAJGrDDTaXw6jm6IPobguYMIOmmoAYaXeQQhUkZIO4";

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export async function getPushPermissionState(): Promise<NotificationPermission | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

/** Asks for notification permission (if needed) and stores a push subscription for this device. */
export async function enablePushNotifications(userId: string): Promise<void> {
  if (!pushSupported()) throw new Error("Meldingen worden niet ondersteund op dit apparaat/deze browser.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Je hebt geen toestemming gegeven voor meldingen.");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}
