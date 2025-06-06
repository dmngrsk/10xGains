import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject, ChangeDetectionStrategy, AfterViewInit, OnDestroy, computed, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { EMPTY } from 'rxjs';
import { filter, map, switchMap, catchError } from 'rxjs/operators';
import { CreateTrainingPlanCommand } from '@shared/api/api.types';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { tapIf } from '@shared/utils/operators/tap-if.operator';
import { PlanCardComponent } from './components/plan-card/plan-card.component';
import { PlanListComponent } from './components/plan-list/plan-list.component';
import { PlanListPageFacade } from './plan-list-page.facade';
import { AddEditPlanDialogComponent, AddEditPlanDialogCloseResult, AddEditPlanDialogData } from '../../components/dialogs/add-edit-plan/add-edit-plan-dialog.component';

@Component({
  selector: 'txg-plan-list-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatDialogModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    PlanCardComponent,
    PlanListComponent,
    NoticeComponent,
    MainLayoutComponent,
  ],
  templateUrl: './plan-list-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanListPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly facade = inject(PlanListPageFacade);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly viewModel = this.facade.viewModel;
  readonly isLoadingSignal = computed(() => this.viewModel().isLoading);
  readonly hasMoreSignal = computed(() => this.viewModel().totalPlans > this.viewModel().plans.length);

  @ViewChild('sentinel') sentinel!: ElementRef;
  private intersectionObserver?: IntersectionObserver;

  ngOnInit(): void {
    this.facade.loadPlanData();
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  onCreatePlanButtonClicked(): void {
    const dialogData = {
      width: '450px',
      data: { isEditMode: false },
      disableClose: true,
    };

    this.dialog.open<AddEditPlanDialogComponent, AddEditPlanDialogData, AddEditPlanDialogCloseResult>(AddEditPlanDialogComponent, dialogData)
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(this.isCreatePlanCommandResult),
        map(result => result.value as CreateTrainingPlanCommand),
        switchMap(createCmd => this.facade.createPlan(createCmd)),
        tapIf(response => !!response.data && !!response.data.id, response => {
          this.snackBar.open('Nowy plan został utworzony.', 'OK', { duration: 3000 });
          this.router.navigate(['plans', response.data!.id]);
        }),
        tapIf(response => !!response.error || !response.data, response => {
          const errorMessage = response.error || 'Nie udało się utworzyć nowego planu.';
          this.snackBar.open(errorMessage, 'Zamknij', { duration: 5000 });
        }),
        catchError((err: Error) => {
          this.snackBar.open(err.message || 'Wystąpił krytyczny błąd podczas operacji planu.', 'Zamknij', { duration: 5000 });
          return EMPTY;
        })
      )
      .subscribe();
  }

  onPlanClicked(planId: string): void {
    this.router.navigate(['plans', planId]);
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
  }

  private setupIntersectionObserver(): void {
    if (!this.sentinel?.nativeElement) {
      setTimeout(() => this.setupIntersectionObserver(), 100);
      return;
    }

    this.intersectionObserver?.disconnect();

    this.intersectionObserver = new IntersectionObserver((entries) => {
      const firstEntry = entries[0];
      if (firstEntry.isIntersecting && !this.isLoadingSignal() && this.hasMoreSignal()) {
        this.facade.loadPlanData(true);
        this.sentinel.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, { threshold: 0.1 });

    this.intersectionObserver.observe(this.sentinel.nativeElement);
  }

  private isCreatePlanCommandResult(result: AddEditPlanDialogCloseResult | undefined | null): result is Extract<AddEditPlanDialogCloseResult, { save: true }> {
    return !!result && 'save' in result && result.save === true;
  }
}
