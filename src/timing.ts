export const HINT_PENALTY_SECONDS = 20;
export function formatTime(seconds:number):string {
 const n=Math.max(0,Math.floor(seconds));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
}
export function scoredSeconds(elapsed:number,hints:number):number {return Math.max(0,Math.floor(elapsed))+Math.max(0,hints)*HINT_PENALTY_SECONDS;}
