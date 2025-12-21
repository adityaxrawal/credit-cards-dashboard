import { BaseClassifier } from './BaseClassifier';

export class ClassifierRegistry {
    private static classifiers: BaseClassifier[] = [];

    static register(classifier: BaseClassifier): void {
        this.classifiers.push(classifier);
        this.classifiers.sort((a, b) => a.priority - b.priority);
    }

    static getClassifiers(): BaseClassifier[] {
        return this.classifiers;
    }

    static reset(): void {
        this.classifiers = [];
    }
}
