/**
 * Service Container
 * 
 * Simple dependency injection container for decoupling controllers from services.
 * Allows registering service instances and resolving them at runtime.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

class ServiceContainer {
    private services: Map<string, unknown> = new Map();
    private factories: Map<string, () => unknown> = new Map();

    /**
     * Register a service instance
     */
    register<T>(key: string, instance: T): void {
        this.services.set(key, instance);
    }

    /**
     * Register a factory function for lazy instantiation
     */
    registerFactory<T>(key: string, factory: () => T): void {
        this.factories.set(key, factory);
    }

    /**
     * Resolve a service by key
     */
    resolve<T>(key: string): T {
        // Check if already instantiated
        if (this.services.has(key)) {
            return this.services.get(key) as T;
        }

        // Check for factory
        if (this.factories.has(key)) {
            const factory = this.factories.get(key)!;
            const instance = factory() as T;
            this.services.set(key, instance); // Cache for future use
            return instance;
        }

        throw new Error(`Service not registered: ${key}`);
    }

    /**
     * Check if a service is registered
     */
    has(key: string): boolean {
        return this.services.has(key) || this.factories.has(key);
    }

    /**
     * Clear all registrations (useful for testing)
     */
    clear(): void {
        this.services.clear();
        this.factories.clear();
    }
}

// Singleton container instance
export const container = new ServiceContainer();

// Service keys as constants for type safety
export const ServiceKeys = {
    GMAIL_SERVICE: 'gmailService',
    TRANSACTION_SERVICE: 'transactionService',
    AUTH_SERVICE: 'authService',
    SESSION_SERVICE: 'sessionService',
    USER_REPOSITORY: 'userRepository',
} as const;

export type ServiceKey = typeof ServiceKeys[keyof typeof ServiceKeys];

export default container;
