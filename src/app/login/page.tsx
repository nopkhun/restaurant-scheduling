import { redirect } from 'next/navigation';

export default function LoginRedirect() {
  redirect('/th/login');
}