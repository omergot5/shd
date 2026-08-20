import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 3000 היא ברירת המחדל לפיתוח רגיל (ושם מכוונות כתובות החזרה של Supabase),
  // אבל כשמריצים דרך כלי שמקצה פורט משלו — הוא מנצח.
  server: { port: Number(process.env.PORT) || 3000 },
})
