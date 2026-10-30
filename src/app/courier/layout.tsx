import CourierProvider from "@/components/CourierProvider";

export default function CourierLayout({ children }: { children: React.ReactNode }) {
  return <CourierProvider>{children}</CourierProvider>;
}
