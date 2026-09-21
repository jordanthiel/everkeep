import { describe, expect, it } from 'vitest'
import { NAV_SECTIONS } from '../src/shared/constants'
import { JOURNEY_GROUPS, JOURNEY_STEPS, nextJourneyPath, nextSectionHome, nextTopicPath, groupForPath, groupProgress, topicAction, withSavedTopics, type StepStatus } from '../src/shared/sections/journey'

describe('guided walkthrough', () => {
  it('covers each existing record section exactly once', () => {
    expect(JOURNEY_STEPS.map((s) => s.path).sort()).toEqual(NAV_SECTIONS.filter((s) => s.id !== 'home').map((s) => s.path).sort())
    expect(new Set(JOURNEY_STEPS.map((s) => s.id)).size).toBe(JOURNEY_STEPS.length)
  })
  it('starts with contacts so later records can reference people', () => {
    expect(nextJourneyPath({})).toBe('/people')
  })
  it('resumes at the first unvisited topic after reviews and skips', () => {
    expect(nextJourneyPath({ people: 'reviewed', identity: 'skipped', financial: 'reviewed' })).toBe('/legal')
  })
  it('reaches review after all topics have been considered, including skipped ones', () => {
    const statuses: Record<string, StepStatus> = Object.fromEntries(JOURNEY_STEPS.map((s) => [s.id, 'skipped']))
    expect(nextJourneyPath(statuses)).toBe('/review')
  })
})


describe('section-led walkthrough', () => {
  it('starts at a section introduction and resumes at the next unfinished section', () => {
    expect(nextSectionHome({})).toBe('/sections/essentials')
    expect(nextSectionHome({people:'reviewed',identity:'not-applicable',legal:'ask-someone'})).toBe('/sections/money')
  })
  it('keeps the section active on its home, topic introduction, and detail pages', () => {
    for (const group of JOURNEY_GROUPS) {
      expect(groupForPath(`/sections/${group.id}`)?.id).toBe(group.id)
      for (const step of group.steps) {
        expect(groupForPath(`/guide/${step.id}`)?.id).toBe(group.id)
        expect(groupForPath(`/${step.id}`)?.id).toBe(group.id)
      }
    }
    expect(groupForPath('/settings')).toBeUndefined()
  })
  it('walks through topic introductions and stops at the section summary', () => {
    expect(nextTopicPath('people', {})).toBe('/guide/identity')
    expect(nextTopicPath('legal', {})).toBe('/sections/essentials?summary=1')
    expect(nextTopicPath('documents', {})).toBe('/sections/wishes?summary=1')
  })
  it('does not re-ask considered topics while continuing, but keeps follow-ups visible', () => {
    const statuses: Record<string, StepStatus> = {identity:'not-applicable',legal:'ask-someone'}
    expect(nextTopicPath('people', statuses)).toBe('/sections/essentials?summary=1')
    const progress = groupProgress(JOURNEY_GROUPS[0], statuses)
    expect(progress.pending.map(step => step.id)).toEqual(['people'])
    expect(progress.followups.map(step => step.id)).toEqual(['legal'])
    expect(progress.reviewed).toBe(0)
    expect(progress.notApplicable).toBe(1)
  })
  it('hands off to review and share when all topics are considered without claiming they are reviewed', () => {
    const statuses: Record<string, StepStatus> = Object.fromEntries(JOURNEY_STEPS.map(step => [step.id,'skipped']))
    expect(nextSectionHome(statuses)).toBe('/finish')
    expect(groupProgress(JOURNEY_GROUPS[0],statuses).reviewed).toBe(0)
    expect(groupProgress(JOURNEY_GROUPS[0],statuses).followups).toHaveLength(3)
  })
})


describe('clear completion status', () => {
  it('keeps skipped topics out of completion progress', () => {
    const progress = groupProgress(JOURNEY_GROUPS[0], { people: 'reviewed', identity: 'skipped', legal: 'not-applicable' })
    expect(progress.complete).toBe(2)
    expect(progress.status).toBe('Needs attention')
    expect(groupProgress(JOURNEY_GROUPS[0], { people: 'reviewed', identity: 'reviewed', legal: 'not-applicable' }).status).toBe('Complete')
  })
  it('recognizes existing saved records without claiming completion or overwriting user choices', () => {
    const statuses = withSavedTopics({ identity: 'need-to-find', legal: 'not-applicable' }, { people: 1, identity: 2, legal: 3 })
    expect(statuses).toEqual({ people: 'in-progress', identity: 'need-to-find', legal: 'not-applicable' })
    expect(nextJourneyPath(statuses)).toBe('/people')
    expect(nextSectionHome(statuses)).toBe('/sections/essentials')
    expect(groupProgress(JOURNEY_GROUPS[0], { people: 'in-progress' }).status).toBe('In progress')
    expect(groupProgress(JOURNEY_GROUPS[0], {}).status).toBe('Not started')
  })
  it('uses explicit actions and resumes unfinished topics', () => {
    expect([topicAction(), topicAction('in-progress'), topicAction('reviewed'), topicAction('need-to-find')]).toEqual(['Start', 'Continue', 'Edit', 'Review'])
    expect(nextTopicPath('people', { identity: 'in-progress' })).toBe('/guide/identity')
  })
})
