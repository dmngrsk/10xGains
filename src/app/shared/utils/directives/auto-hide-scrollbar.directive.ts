import { Directive, ElementRef, HostListener, inject, OnInit, Renderer2 } from '@angular/core';

@Directive({
  selector: '[txgAutoHideScrollbar]'
})
export class AutoHideScrollbarDirective implements OnInit {

  private scrollTimeout: NodeJS.Timeout | null = null;
  private readonly className = 'txg-auto-hide-scrollbar';

  private el = inject(ElementRef);
  private renderer = inject(Renderer2);

  ngOnInit(): void {
    this.renderer.addClass(this.el.nativeElement, this.className);
  }

  @HostListener('scroll')
  onScroll() {
    this.renderer.removeClass(this.el.nativeElement, this.className);

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    this.scrollTimeout = setTimeout(() => {
      this.renderer.addClass(this.el.nativeElement, this.className);
    }, 1000);
  }
}
