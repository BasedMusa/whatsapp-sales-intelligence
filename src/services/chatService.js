import { query, getClient } from '../config/database.js';

export class ChatService {

  /**
   * Get cached conversations from database
   */
  async getCachedConversations(remoteJids) {
    if (!remoteJids || remoteJids.length === 0) {
      return new Map();
    }

    const queryText = `
      SELECT
        "remoteJid",
        conversation_text,
        total_messages,
        conversation_duration_days,
        last_customer_message_time,
        chat_name,
        processed_at
      FROM "ConversationCache"
      WHERE "remoteJid" = ANY($1::text[])
    `;

    try {
      const result = await query(queryText, [remoteJids]);
      const cacheMap = new Map();

      for (const row of result.rows) {
        cacheMap.set(row.remoteJid, {
          conversation: row.conversation_text,
          metadata: {
            totalMessages: row.total_messages,
            conversationDurationDays: row.conversation_duration_days,
            lastCustomerMessageTime: row.last_customer_message_time
          },
          chatName: row.chat_name,
          cachedAt: row.processed_at
        });
      }

      console.log(`📦 Found ${cacheMap.size} cached conversations out of ${remoteJids.length} requested`);
      return cacheMap;
    } catch (error) {
      console.error('Error fetching cached conversations:', error);
      return new Map();
    }
  }

  /**
   * Save conversations to cache
   */
  async saveConversationsToCache(conversations) {
    if (!conversations || conversations.length === 0) {
      return;
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO "ConversationCache" (
          "remoteJid",
          conversation_text,
          total_messages,
          conversation_duration_days,
          last_customer_message_time,
          chat_name,
          processed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT ("remoteJid") DO UPDATE SET
          conversation_text = EXCLUDED.conversation_text,
          total_messages = EXCLUDED.total_messages,
          conversation_duration_days = EXCLUDED.conversation_duration_days,
          last_customer_message_time = EXCLUDED.last_customer_message_time,
          chat_name = EXCLUDED.chat_name,
          processed_at = NOW(),
          UPDATED_AT = NOW()
      `;

      let savedCount = 0;
      for (const conv of conversations) {
        if (conv.conversation && conv.conversation.trim() !== '') {
          await client.query(insertQuery, [
            conv.remoteJid,
            conv.conversation,
            conv.metadata?.totalMessages || 0,
            conv.metadata?.conversationDurationDays || 0,
            conv.metadata?.lastCustomerMessageTime || null,
            conv.chatName || null
          ]);
          savedCount++;
        }
      }

      await client.query('COMMIT');
      console.log(`💾 Saved ${savedCount} conversations to cache`);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error saving conversations to cache:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Get individual chats from the last 3 months that haven't been analyzed
   */
  async getUnanalyzedChats() {
    const queryText = `
      SELECT
          c."remoteJid" as chat_id,
          c."name" as chat_name,
          c."unreadMessages" as unread_count,
          CASE
              WHEN c."remoteJid" LIKE '%@g.us' THEN 'group'
              ELSE 'individual'
          END as chat_type,
          c."updatedAt" as last_updated,
          c."createdAt" as created_at
      FROM "Chat" c
      WHERE
          c."remoteJid" NOT LIKE '%@g.us'
          AND (c."updatedAt" >= NOW() - INTERVAL '3 months'
               OR EXISTS (
                   SELECT 1 FROM "Message" m
                   WHERE m."key"->>'remoteJid' = c."remoteJid"
                   AND TO_TIMESTAMP(m."messageTimestamp") >= NOW() - INTERVAL '3 months'
               ))
          AND NOT EXISTS (
              SELECT 1 FROM "SalesAnalysisReport" a
              WHERE a."remoteJid" = c."remoteJid"
          )
      ORDER BY c."updatedAt" DESC;
    `;

    try {
      const result = await query(queryText);
      console.log(`Found ${result.rows.length} unanalyzed chats`);
      return result.rows;
    } catch (error) {
      console.error('Error fetching unanalyzed chats:', error);
      throw error;
    }
  }

  /**
   * Get all messages for a specific chat
   */
  async getMessagesForChat(remoteJid) {
    const queryText = `
      SELECT
            c.name as chat_name,
            c."remoteJid",
            m."pushName" as sender_name,
            m."messageType",
            m."key"->>'fromMe' as from_me,
            m.message->>'conversation' as text_content,
            to_timestamp(m."messageTimestamp") as sent_at,
            m."messageTimestamp"
        FROM "Message" m
        JOIN "Chat" c ON m."key"->>'remoteJid' = c."remoteJid"
        WHERE c."remoteJid" = $1
        ORDER BY m."messageTimestamp" ASC;
    `;

    try {
      const result = await query(queryText, [remoteJid]);
      return result.rows;
    } catch (error) {
      console.error(`Error fetching messages for chat ${remoteJid}:`, error);
      throw error;
    }
  }

  /**
   * Build conversation string from messages
   */
  buildConversationString(messages, maxMessages = 200) {
    if (!messages || messages.length === 0) {
      return '';
    }

    // Limit conversation length for performance
    const recentMessages = messages.slice(-maxMessages);

    let fullConversation = '';

    for (const message of recentMessages) {
      const time = new Date(message.sent_at).toLocaleString();
      const name = message.from_me === 'true' ? 'Sales Agent' : 'Customer';
      const text = message.messageType === 'conversation'
        ? message.text_content
        : `[${message.messageType.toUpperCase()}]`;

      if (text && text.trim() !== '') {
        fullConversation += `[${time}] ${name}: ${text}\n`;
      }
    }

    return fullConversation;
  }

  /**
   * Get conversation metadata for analysis
   */
  getConversationMetadata(messages) {
    if (!messages || messages.length === 0) {
      return {
        totalMessages: 0,
        conversationDurationDays: 0,
        lastCustomerMessageTime: null
      };
    }

    const customerMessages = messages.filter(m => m.from_me !== 'true');
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    const lastCustomerMessage = customerMessages[customerMessages.length - 1];

    const duration = lastMessage.sent_at && firstMessage.sent_at
      ? Math.ceil((new Date(lastMessage.sent_at) - new Date(firstMessage.sent_at)) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      totalMessages: messages.length,
      conversationDurationDays: duration,
      lastCustomerMessageTime: lastCustomerMessage ? lastCustomerMessage.sent_at : null
    };
  }

  /**
   * Process multiple chats in parallel with caching
   */
  async processChatsBatch(chats, batchSize = 8) {
    const results = [];
    const allChatIds = chats.map(chat => chat.chat_id);

    // Get cached conversations first
    console.log(`🔍 Checking cache for ${allChatIds.length} conversations...`);
    const cachedConversations = await this.getCachedConversations(allChatIds);

    const chatsToProcess = [];
    const cachedResults = [];

    // Separate cached and uncached chats
    for (const chat of chats) {
      if (cachedConversations.has(chat.chat_id)) {
        const cached = cachedConversations.get(chat.chat_id);
        cachedResults.push({
          remoteJid: chat.chat_id,
          chatName: cached.chatName || chat.chat_name,
          conversation: cached.conversation,
          metadata: cached.metadata,
          hasMessages: true,
          fromCache: true
        });
      } else {
        chatsToProcess.push(chat);
      }
    }

    console.log(`✅ Using ${cachedResults.length} cached conversations`);
    console.log(`🔄 Building ${chatsToProcess.length} new conversations`);

    // Add cached results
    results.push(...cachedResults);

    // Process uncached chats
    const newConversations = [];

    for (let i = 0; i < chatsToProcess.length; i += batchSize) {
      const batch = chatsToProcess.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chatsToProcess.length/batchSize)} (${batch.length} chats)`);

      const batchPromises = batch.map(async (chat) => {
        try {
          const messages = await this.getMessagesForChat(chat.chat_id);
          const conversation = this.buildConversationString(messages);
          const metadata = this.getConversationMetadata(messages);

          const result = {
            remoteJid: chat.chat_id,
            chatName: chat.chat_name,
            conversation,
            metadata,
            hasMessages: messages.length > 0
          };

          // Collect for caching
          if (result.hasMessages) {
            newConversations.push(result);
          }

          return result;
        } catch (error) {
          console.error(`Error processing chat ${chat.chat_id}:`, error);
          return {
            remoteJid: chat.chat_id,
            error: error.message,
            hasMessages: false
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < chatsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Save new conversations to cache
    if (newConversations.length > 0) {
      console.log(`💾 Caching ${newConversations.length} new conversations...`);
      await this.saveConversationsToCache(newConversations);
    }

    return results;
  }
}