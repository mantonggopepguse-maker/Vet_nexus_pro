declare module 'html2pdf.js' {
    interface Html2PdfOptions {
        margin?: number | number[];
        filename?: string;
        image?: { type: string; quality: number };
        html2canvas?: any;
        jsPDF?: any;
    }

    interface Html2PdfWorker {
        from(element: HTMLElement): Html2PdfWorker;
        set(options: Html2PdfOptions): Html2PdfWorker;
        save(): void;
        outputPdf(type?: string, options?: any): Promise<any>;
        // Add other methods as needed
    }

    function html2pdf(): Html2PdfWorker;
    export default html2pdf;
}
