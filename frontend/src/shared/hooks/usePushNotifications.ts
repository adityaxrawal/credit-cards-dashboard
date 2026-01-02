import { useState, useEffect } from 'react';

export function usePushNotifications() {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            setPermission(Notification.permission);

            // Check for existing subscription
            navigator.serviceWorker.ready.then(registration => {
                registration.pushManager.getSubscription().then(sub => {
                    setSubscription(sub);
                });
            });
        }
    }, []);

    const requestPermission = async () => {
        if (!isSupported) return 'denied';
        const result = await Notification.requestPermission();
        setPermission(result);
        return result;
    };

    const subscribeToPush = async (vapidPublicKey: string) => {
        if (!isSupported) throw new Error('Push notifications not supported');

        // Register SW if not already
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

        setSubscription(sub);
        return sub;
    };

    const unsubscribeFromPush = async () => {
        if (!subscription) return;
        await subscription.unsubscribe();
        setSubscription(null);
    };

    return {
        isSupported,
        permission,
        subscription,
        requestPermission,
        subscribeToPush,
        unsubscribeFromPush
    };
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
