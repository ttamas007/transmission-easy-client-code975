import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Popover } from 'react-tiny-popover';

interface Props {
  children: React.ReactNode;
  content: React.ReactNode;
  className: string;
  onOpenChange: (open: boolean) => void;
}

export default function HoverTooltip({ children, content, className, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const cancelLeave = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  }, []);
  const close = useCallback(() => {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    enterTimer.current = null;
    cancelLeave();
    setOpen(false);
  }, [cancelLeave]);
  const show = () => {
    cancelLeave();
    if (enterTimer.current || open) return;
    enterTimer.current = setTimeout(() => {
      enterTimer.current = null;
      setOpen(true);
    }, 350);
  };
  const hide = () => {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    enterTimer.current = null;
    cancelLeave();
    leaveTimer.current = setTimeout(close, 150);
  };
  useEffect(() => onOpenChange(open), [open, onOpenChange]);
  useEffect(
    () => () => {
      if (enterTimer.current) clearTimeout(enterTimer.current);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    []
  );
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && contentRef.current?.contains(event.target)) return;
      close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close();
    };
    document.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open, close]);
  return (
    <Popover
      isOpen={open}
      positions={['bottom', 'top', 'right', 'left']}
      align="start"
      padding={8}
      boundaryInset={8}
      containerStyle={{ zIndex: '1100' }}
      content={
        <div
          ref={contentRef}
          id={id}
          role="tooltip"
          className="torrent-name-tooltip"
          onMouseEnter={cancelLeave}
          onMouseLeave={hide}
        >
          {content}
        </div>
      }
    >
      <div
        className={className}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={close}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && enterTimer.current) {
            event.stopPropagation();
            close();
          }
        }}
      >
        {children}
      </div>
    </Popover>
  );
}
