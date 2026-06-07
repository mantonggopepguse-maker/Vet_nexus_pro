import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes user input to prevent XSS attacks
 * @param input - The user input to sanitize
 * @returns Sanitized string safe for rendering
 */
export const sanitizeInput = (input: string | null | undefined): string => {
    if (!input) return '';
    return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: [], // Strip all HTML tags
        ALLOWED_ATTR: [], // Strip all attributes
        KEEP_CONTENT: true // Keep text content
    });
};

/**
 * Sanitizes HTML while preserving safe formatting tags
 * Use this for rich text fields like descriptions
 */
export const sanitizeHtml = (html: string | null | undefined): string => {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: []
    });
};

/**
 * Sanitizes an entire object's string properties
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
    const sanitized: any = {};
    for (const key in obj) {
        const value = obj[key];
        if (typeof value === 'string') {
            sanitized[key] = sanitizeInput(value);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};
