import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

interface TodoItem {
  id: string | number;
  name: string;
}

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await supabase.from('todos').select()

  return (
    <ul className="p-8 space-y-2">
      {todos?.map((todo: TodoItem) => (
        <li key={todo.id} className="text-slate-800 font-semibold">{todo.name}</li>
      ))}
    </ul>
  )
}
