import { redirect } from 'next/navigation';

export default function DineInMenuRedirect() {
  redirect('/menu?mode=dine_in');
}
