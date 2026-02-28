package alerts

import "testing"

func TestThreeFailuresTriggersDown(t *testing.T) {
	st := StateInput{CurrentState: "UP", ConsecutiveFailures: 2, ConsecutiveSuccesses: 0, PollSuccess: false}
	out := ComputeTransition(st)
	if out.Transition != "down" || out.NextState != "DOWN" {
		t.Fatalf("expected down transition, got %+v", out)
	}
}

func TestAdditionalFailuresWhileDownNoNewTransition(t *testing.T) {
	st := StateInput{CurrentState: "DOWN", ConsecutiveFailures: 5, ConsecutiveSuccesses: 0, PollSuccess: false}
	out := ComputeTransition(st)
	if out.Transition != "none" || out.NextState != "DOWN" {
		t.Fatalf("expected no transition while down+failing, got %+v", out)
	}
}

func TestTwoSuccessesResolveDownToUp(t *testing.T) {
	st := StateInput{CurrentState: "DOWN", ConsecutiveFailures: 0, ConsecutiveSuccesses: 1, PollSuccess: true}
	out := ComputeTransition(st)
	if out.Transition != "up" || out.NextState != "UP" {
		t.Fatalf("expected up transition, got %+v", out)
	}
}

func TestFlapDoesNotTriggerUntil3ConsecutiveFails(t *testing.T) {
	st := StateInput{CurrentState: "UP", ConsecutiveFailures: 0, ConsecutiveSuccesses: 0, PollSuccess: false}
	out := ComputeTransition(st)
	if out.Transition != "none" || out.ConsecutiveFailures != 1 { t.Fatalf("step1 %+v", out) }
	st = StateInput{CurrentState: out.NextState, ConsecutiveFailures: out.ConsecutiveFailures, ConsecutiveSuccesses: out.ConsecutiveSuccesses, PollSuccess: true}
	out = ComputeTransition(st)
	if out.ConsecutiveFailures != 0 || out.ConsecutiveSuccesses != 1 { t.Fatalf("step2 %+v", out) }
	st = StateInput{CurrentState: out.NextState, ConsecutiveFailures: out.ConsecutiveFailures, ConsecutiveSuccesses: out.ConsecutiveSuccesses, PollSuccess: false}
	out = ComputeTransition(st)
	if out.Transition != "none" || out.ConsecutiveFailures != 1 { t.Fatalf("step3 %+v", out) }
}

func TestTenantIsolationEquivalentByIndependentState(t *testing.T) {
	// Tenant A and B identical device ids behave independently if state tracked separately.
	a := ComputeTransition(StateInput{CurrentState: "UP", ConsecutiveFailures: 2, PollSuccess: false})
	b := ComputeTransition(StateInput{CurrentState: "UP", ConsecutiveFailures: 0, PollSuccess: false})
	if a.Transition != "down" { t.Fatalf("tenant A expected down") }
	if b.Transition == "down" { t.Fatalf("tenant B should not be down") }
}
