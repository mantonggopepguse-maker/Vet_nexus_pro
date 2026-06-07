
/**
 * Simulated Payment Terminal Service
 * This service represents the interface to actual hardware/API terminals (e.g. Stripe Terminal, Adyen, etc.)
 * In a production environment, this would call specialized SDKs or backend proxies.
 */

export interface TerminalResponse {
    success: boolean;
    transactionId?: string;
    error?: string;
}

export const terminalService = {
    /**
     * Connects to the local payment terminal
     */
    connect: async (): Promise<boolean> => {
        // Simulate local network discovery of a terminal
        await new Promise(resolve => setTimeout(resolve, 1200));
        return true;
    },

    /**
     * Initiates a payment request on the terminal
     */
    processPayment: async (amount: number, currency: string = 'USD'): Promise<TerminalResponse> => {
        console.log(`PO: Initiating terminal payment for ${currency}${amount}`);

        // Simulate customer interaction time (tap/swipe/pin)
        await new Promise(resolve => setTimeout(resolve, 3500));

        // Randomly simulate success (95% rate)
        const isSuccess = Math.random() < 0.95;

        if (isSuccess) {
            return {
                success: true,
                transactionId: `TERM_${Math.random().toString(36).substr(2, 9).toUpperCase()}`
            };
        } else {
            return {
                success: false,
                error: 'CARD_DECLINED'
            };
        }
    }
};
