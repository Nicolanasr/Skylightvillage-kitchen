import { redirect } from 'next/navigation';

export default function CampingMenuRedirect() {
  redirect('/menu?mode=camping');
}
