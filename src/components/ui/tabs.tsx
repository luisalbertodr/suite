import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

function scrollFriendlyClassName(className?: string): string {
  if (!className) return ""
  return className
    .split(/\s+/)
    .filter(
      (token) =>
        token &&
        token !== "grid" &&
        !token.startsWith("grid-cols-") &&
        token !== "flex-wrap" &&
        token !== "justify-center",
    )
    .join(" ")
}

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  /** Desactiva flechas y arrastre (p. ej. tabs que caben siempre). */
  disableScroll?: boolean
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, disableScroll = false, children, ...props }, ref) => {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)
  const dragRef = React.useRef({
    active: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
  })

  const updateScrollState = React.useCallback(() => {
    const el = scrollRef.current
    if (!el || disableScroll) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }
    const overflow = el.scrollWidth - el.clientWidth > 2
    setCanScrollLeft(overflow && el.scrollLeft > 2)
    setCanScrollRight(overflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [disableScroll])

  const scrollByPage = React.useCallback((direction: -1 | 1) => {
    const el = scrollRef.current
    if (!el) return
    const delta = Math.max(120, Math.round(el.clientWidth * 0.65)) * direction
    el.scrollBy({ left: delta, behavior: "smooth" })
  }, [])

  const scrollActiveTabIntoView = React.useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const active = container.querySelector<HTMLElement>('[data-state="active"]')
    active?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" })
  }, [])

  React.useEffect(() => {
    if (disableScroll) return
    const el = scrollRef.current
    if (!el) return

    updateScrollState()
    const ro = new ResizeObserver(() => updateScrollState())
    ro.observe(el)
    const list = el.firstElementChild
    if (list) ro.observe(list)

    return () => ro.disconnect()
  }, [disableScroll, updateScrollState, children])

  const onScroll = () => updateScrollState()

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disableScroll) return
    const el = scrollRef.current
    if (!el || e.button !== 0) return
    dragRef.current = {
      active: true,
      moved: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
    }
    el.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disableScroll || !dragRef.current.active) return
    const el = scrollRef.current
    if (!el) return
    const dx = e.clientX - dragRef.current.startX
    if (Math.abs(dx) > 4) dragRef.current.moved = true
    el.scrollLeft = dragRef.current.startScrollLeft - dx
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disableScroll || !dragRef.current.active) return
    const el = scrollRef.current
    if (el?.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId)
    }
    dragRef.current.active = false
    updateScrollState()
  }

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current.moved = false
    }
  }

  const listClassName = cn(
    "inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground flex-nowrap w-max min-w-full gap-0",
    scrollFriendlyClassName(className),
  )

  if (disableScroll) {
    return (
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    )
  }

  return (
    <div className="relative w-full">
      {canScrollLeft ? (
        <button
          type="button"
          aria-label="Desplazar pestañas a la izquierda"
          className="absolute -left-1 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/95 text-muted-foreground shadow-sm backdrop-blur-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => scrollByPage(-1)}
          tabIndex={-1}
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
        </button>
      ) : null}

      <div
        ref={scrollRef}
        className={cn(
          "overflow-x-auto overscroll-x-contain touch-pan-x cursor-grab active:cursor-grabbing",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          canScrollLeft && "pl-5",
          canScrollRight && "pr-5",
        )}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onClick={() => {
          window.requestAnimationFrame(() => scrollActiveTabIntoView())
        }}
      >
        <TabsPrimitive.List ref={ref} className={listClassName} {...props}>
          {children}
        </TabsPrimitive.List>
      </div>

      {canScrollRight ? (
        <button
          type="button"
          aria-label="Desplazar pestañas a la derecha"
          className="absolute -right-1 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/95 text-muted-foreground shadow-sm backdrop-blur-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => scrollByPage(1)}
          tabIndex={-1}
        >
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
      ) : null}
    </div>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
