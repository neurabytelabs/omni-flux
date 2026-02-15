export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private isRunning: boolean = false;
  
  // Smoothing
  private smoothLow = 0;
  private smoothMid = 0;
  private smoothHigh = 0;
  private smoothLevel = 0;

  async init(): Promise<boolean> {
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.ctx.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.isRunning = true;
      return true;
    } catch (e) {
      console.error("Audio Init Failed", e);
      return false;
    }
  }

  getFrequencyData(sensitivity: number, smoothing: number) {
    if (!this.isRunning || !this.analyser || !this.dataArray) {
      return { low: 0, mid: 0, high: 0, level: 0, waveform: new Uint8Array(0) };
    }

    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Simple band logic
    const binCount = this.analyser.frequencyBinCount;
    const lowBound = Math.floor(binCount * 0.1);
    const midBound = Math.floor(binCount * 0.4);
    
    let lowSum = 0, midSum = 0, highSum = 0, totalSum = 0;

    for (let i = 0; i < binCount; i++) {
      const val = this.dataArray[i] / 255.0;
      totalSum += val;
      if (i < lowBound) lowSum += val;
      else if (i < midBound) midSum += val;
      else highSum += val;
    }

    const rawLow = (lowSum / lowBound) * sensitivity;
    const rawMid = (midSum / (midBound - lowBound)) * sensitivity;
    const rawHigh = (highSum / (binCount - midBound)) * sensitivity;
    const rawLevel = (totalSum / binCount) * sensitivity;

    // Lerp smoothing
    const alpha = 1.0 - smoothing; // Higher smoothing = lower alpha
    this.smoothLow += (rawLow - this.smoothLow) * alpha;
    this.smoothMid += (rawMid - this.smoothMid) * alpha;
    this.smoothHigh += (rawHigh - this.smoothHigh) * alpha;
    this.smoothLevel += (rawLevel - this.smoothLevel) * alpha;

    return {
      low: this.smoothLow,
      mid: this.smoothMid,
      high: this.smoothHigh,
      level: this.smoothLevel,
      waveform: this.dataArray
    };
  }
  
  // Get time domain data for waveform viz
  getTimeDomainData(): Uint8Array {
      if (!this.analyser) return new Uint8Array(0);
      const data = new Uint8Array(this.analyser.fftSize);
      this.analyser.getByteTimeDomainData(data);
      return data;
  }

  cleanup() {
    this.isRunning = false;
    if (this.source) this.source.disconnect();
    if (this.ctx) this.ctx.close();
  }
}