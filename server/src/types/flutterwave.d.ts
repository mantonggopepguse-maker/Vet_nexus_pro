declare module 'flutterwave-node-v3' {
    interface PaymentPayload {
        tx_ref: string;
        amount: number;
        currency: string;
        redirect_url: string;
        payment_options: string;
        customer: {
            email: string;
            name: string;
        };
        customizations?: {
            title?: string;
            description?: string;
            logo?: string;
        };
        meta?: Record<string, any>;
    }

    interface PaymentResponse {
        status: string;
        message: string;
        data?: {
            link: string;
        };
    }

    interface TransactionVerifyResponse {
        status: string;
        message: string;
        data?: {
            id: number;
            tx_ref: string;
            flw_ref: string;
            status: string;
            amount: number;
            currency: string;
            payment_type: string;
            created_at: string;
            meta?: Record<string, any>;
            card?: {
                last_4digits?: string;
            };
        };
    }

    interface SubscriptionPayload {
        token: string;
        email: string;
        amount: number;
        currency: string;
        tx_ref: string;
        payment_plan: string;
    }

    class Flutterwave {
        constructor(publicKey: string, secretKey: string);

        Payment: {
            initialize(payload: PaymentPayload): Promise<PaymentResponse>;
        };

        Transaction: {
            verify(payload: { id: string }): Promise<TransactionVerifyResponse>;
            verify_by_ref(payload: { tx_ref: string }): Promise<TransactionVerifyResponse>;
        };

        Subscription: {
            create(payload: SubscriptionPayload): Promise<any>;
            cancel(payload: { id: string }): Promise<any>;
            fetch(payload: { email: string }): Promise<any>;
        };
    }

    export default Flutterwave;
}
