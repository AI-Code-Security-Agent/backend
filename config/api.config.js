const API_CONFIG = {
  RAG_API: {
    BASE_URL: process.env.RAG_API_URL || 'http://localhost:8001',
    ENDPOINTS: {
      QUERY: '/api/chat/message',
      QUERY_STREAM: "/api/chat/message/stream",
      HEALTH: '/health',
    },
  },
  LLM_API: {
    BASE_URL: process.env.NEXT_PUBLIC_LLM_API_URL || 'http://localhost:8000',
    ENDPOINTS: {
      CHAT: '/chat',
      HEALTH: '/',
      SESSIONS: '/sessions',
      CHAT_STREAM: '/chat/stream',
    },
  },

};

module.exports = API_CONFIG;