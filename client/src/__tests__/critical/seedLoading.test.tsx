import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDomainStore } from '../../stores/domainStore';
import type { Seed } from '../../types/global';

describe('Seed Loading - Critical Path', () => {
  beforeEach(() => {
    useDomainStore.setState({
      seeds: {
        byFigure: {},
        selectedId: null,
        isLoading: false,
        error: null
      }
    });
  });

  it('should cache seeds for a figure', () => {
    const { result } = renderHook(() => useDomainStore());
    const testSeeds: Seed[] = [
      {
        id: '1',
        title: 'Test Seed',
      } as any
    ];

    act(() => {
      result.current.cacheSeedsForFigure('einstein', testSeeds);
    });

    expect(result.current.seeds.byFigure['einstein']).toHaveLength(1);
    expect(result.current.seeds.byFigure['einstein'][0].title).toBe('Test Seed');
  });

  it('should select a seed by ID (string)', () => {
    const { result } = renderHook(() => useDomainStore());

    act(() => {
      result.current.selectSeed('123');
    });

    expect(result.current.seeds.selectedId).toBe('123');
  });

  it('should select a seed by ID (number)', () => {
    const { result } = renderHook(() => useDomainStore());

    act(() => {
      result.current.selectSeed(456);
    });

    expect(result.current.seeds.selectedId).toBe('456');
  });

  it('should handle null seed selection', () => {
    const { result } = renderHook(() => useDomainStore());

    act(() => {
      result.current.selectSeed('123');
    });
    expect(result.current.seeds.selectedId).toBe('123');

    act(() => {
      result.current.selectSeed(null);
    });
    expect(result.current.seeds.selectedId).toBeNull();
  });

  it('should set loading state', () => {
    const { result } = renderHook(() => useDomainStore());

    act(() => {
      result.current.setSeedLoading(true);
    });
    expect(result.current.seeds.isLoading).toBe(true);

    act(() => {
      result.current.setSeedLoading(false);
    });
    expect(result.current.seeds.isLoading).toBe(false);
  });

  it('should cache seeds for multiple figures', () => {
    const { result } = renderHook(() => useDomainStore());
    const einsteinSeeds: Seed[] = [
      {
        id: '1',
        title: 'Relativity',
      } as any
    ];
    const socratesSeeds: Seed[] = [
      {
        id: '2',
        title: 'Wisdom',
      } as any
    ];

    act(() => {
      result.current.cacheSeedsForFigure('einstein', einsteinSeeds);
      result.current.cacheSeedsForFigure('socrates', socratesSeeds);
    });

    expect(result.current.seeds.byFigure['einstein']).toHaveLength(1);
    expect(result.current.seeds.byFigure['socrates']).toHaveLength(1);
    expect(Object.keys(result.current.seeds.byFigure)).toHaveLength(2);
  });
});
