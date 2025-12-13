import { extractTransactionFromEmail } from '../extraction.service';
import { ExtractionInput } from '../extraction.service';

interface WorkerData {
    userId: string;
    email: ExtractionInput;
    workerId: number;
}

export default async function ({ userId, email, workerId }: WorkerData) {
    try {
        const result = await extractTransactionFromEmail(userId, email);
        return {
            status: result.status,
            result,
            workerId
        };
    } catch (error: any) {
        return {
            status: 'error',
            error: error.message,
            workerId
        };
    }
}
