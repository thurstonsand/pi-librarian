export async function listWithCap(limit, fetchPage) {
    const items = [];
    // One page size for every request, since GitHub pages by offset: shrinking it for the final
    // probe would re-read the start of the list instead of the item past the cap.
    const perPage = Math.min(100, limit + 1);
    let page = 1;
    while (items.length <= limit) {
        const pageItems = await fetchPage(page, perPage);
        items.push(...pageItems);
        if (pageItems.length < perPage)
            break;
        page += 1;
    }
    const truncated = items.length > limit;
    return {
        items: items.slice(0, limit),
        truncated,
    };
}
