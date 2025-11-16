import SwipeCards from "@/components/SwipeCards";

export default function Home() {
  return (
    <div className="w-[85%] mx-auto flex flex-col gap-4 items-center">
      <div className="w-full h-[400px]">
        <SwipeCards />
      </div>
    </div>
  );
}
