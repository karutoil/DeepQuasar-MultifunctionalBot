/**
 * Utility functions for debugging message content issues with embeds
 */

/**
 * Log detailed information about message content for debugging
 * @param {string} source - Where this is being called from
 * @param {string} messageId - Message ID
 * @param {string} content - Content to analyze
 */
function logContentDetails(source, messageId, content) {
    console.log(`[Content Debug from ${source}]:`, {
        messageId: messageId || '(no ID)',
        hasContent: !!content,
        contentType: typeof content,
        contentLength: content ? content.length : 0,
        isEmpty: content === '',
        isUndefined: content === undefined,
        isNull: content === null,
        contentValue: content || '(empty)',
        hasMentions: content ? 
            content.includes('@everyone') || 
            content.includes('@here') || 
            content.match(/<@!?\d+>/g) || // User mention pattern
            content.match(/<@&\d+>/g) // Role mention pattern
            : false
    });
}

/**
 * Verify that a message ID is being handled as a string to maintain precision
 * @param {string|number} messageId - Message ID to check
 * @returns {string} - The string version of the ID
 */
function ensureStringMessageId(messageId) {
    // Convert to string if needed
    const idStr = String(messageId);
    
    // Check if the original ID might have been parsed as a number and lost precision
    const originalLength = String(messageId).length;
    const convertedLength = idStr.length;
    
    if (typeof messageId === 'number' && originalLength !== convertedLength) {
        console.warn('Message ID precision issue detected:', {
            original: messageId,
            asString: idStr,
            originalLength,
            convertedLength,
            difference: originalLength - convertedLength
        });
    }
    
    return idStr;
}

module.exports = {
    logContentDetails,
    ensureStringMessageId
};
