import { LatestUpdates } from "@/components/LatestUpdates";
import { TodaySchedule } from "@/components/TodaySchedule";
import type { PortalFeedItem } from "@/lib/feed-schema";
import { selectLatestUpdates, selectTodayItems } from "@/lib/feed-view";

export function PortalFeedSections({
  items,
  now = new Date(),
}: {
  items: readonly PortalFeedItem[];
  now?: Date;
}) {
  const todayItems = selectTodayItems(items, now);
  const latestItems = selectLatestUpdates(items);

  return (
    <>
      <TodaySchedule items={todayItems} />
      <LatestUpdates items={latestItems} />
    </>
  );
}
