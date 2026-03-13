import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";

// URL de tu backend
const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "https://carolin-nonprovisional-correctly.ngrok-free.dev";

/**
 * Configuración de cómo se manejan las notificaciones cuando la app está en foreground
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registra el dispositivo para recibir notificaciones push
 * @param pacienteId - ID del paciente en la base de datos
 * @returns Token de Expo o null si hay error
 */
export async function registerForPushNotifications(
  pacienteId: number,
): Promise<string | null> {
  try {
    // Solo funciona en dispositivos físicos
    if (!Device.isDevice) {
      console.warn(
        "[PUSH] Las notificaciones push solo funcionan en dispositivos físicos",
      );
      return null;
    }

    // Verificar permisos existentes
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Si no tiene permisos, solicitarlos
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("[PUSH] Permiso de notificaciones denegado");
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn(
        "[PUSH] No hay projectId de EAS; se omite registro de push en este build",
      );
      return null;
    }

    // Obtener el token de Expo
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

    const token = tokenData.data;

    if (!token) {
      console.error("[PUSH] No se pudo obtener el token");
      return null;
    }

    // Registrar el token en el backend
    const response = await fetch(
      `${BACKEND_URL}/notifications/register-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pacienteId,
          token,
          deviceType: Platform.OS,
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "[PUSH] Error registrando token en el backend:",
        response.status,
      );
      return null;
    }

    const result = await response.json();
    console.log("[PUSH] Token registrado exitosamente:", result);

    // Configurar canal de notificaciones para Android
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Notificaciones de NutriU",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B6B",
        sound: "default",
      });
    }

    return token;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      Platform.OS === "android" &&
      message.includes("FirebaseApp is not initialized")
    ) {
      console.warn(
        "[PUSH] FCM no configurado en Android. La app seguira funcionando sin push.",
      );
      return null;
    }
    console.error("[PUSH] Error registrando notificaciones:", error);
    return null;
  }
}

/**
 * Elimina el token del dispositivo del backend
 * @param pacienteId - ID del paciente
 * @param token - Token a eliminar
 */
export async function unregisterPushToken(
  pacienteId: number,
  token: string,
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/notifications/remove-token`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pacienteId,
        token,
      }),
    });
    console.log("[PUSH] Token desregistrado exitosamente");
  } catch (error) {
    console.error("[PUSH] Error desregistrando token:", error);
  }
}

/**
 * Agrega un listener para cuando se recibe una notificación
 * @param callback - Función a ejecutar cuando llega una notificación
 * @returns Subscription que debe ser removida en cleanup
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void,
) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Agrega un listener para cuando el usuario toca una notificación
 * @param callback - Función a ejecutar cuando se toca una notificación
 * @returns Subscription que debe ser removida en cleanup
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Obtiene todas las notificaciones programadas
 */
export async function getScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Cancela todas las notificaciones programadas
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Limpia el badge de notificaciones
 */
export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0);
}
