"""Assemble actual UI clips, labelled scope, local narration and subtitles."""
import hashlib,json,subprocess,textwrap
from pathlib import Path

plan=json.loads(Path('docs/media/SIMULATED_monad_walkthrough_plan.json').read_text())
work=Path('.runtime/monad_20261024/walkthrough');media=Path('docs/media')
def duration(p):
 return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(p)],text=True))
def stamp(seconds):
 ms=round(seconds*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
subtitles=[];timeline=0;outputs=[];sources={};audio=[]
for section in plan['sections']:
 name=section['name'];seconds=section['seconds'];raw=Path(section['raw'])
 narration=work/f'{name}.txt';narration.write_text(section['narration'])
 voice=work/f'{name}.aiff'
 subprocess.run(['/usr/bin/say','-v','Samantha','-r','155','-f',str(narration),'-o',str(voice)],check=True)
 speech=duration(voice);speed=max(1,speech/(seconds-0.5))
 caption=work/f'{name}_caption.txt';caption.write_text('SIMULATED / '+section['caption'])
 start=section.get('sourceStart',max(0,duration(raw)-seconds))
 output=work/f'{name}.mp4'
 vf=f'scale=1280:800,setsar=1,fps=25,drawtext=fontfile=assets/fonts/NotoSans-Regular.ttf:textfile={caption}:fontsize=16:fontcolor=0x142124:box=1:boxcolor=white@0.97:boxborderw=8:x=16:y=h-th-18'
 subprocess.run(['ffmpeg','-y','-v','warning','-ss',str(start),'-i',str(raw),'-i',str(voice),'-vf',vf,'-af',f'atempo={speed},apad,atrim=duration={seconds}','-t',str(seconds),'-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',str(output)],check=True)
 words=section['narration'].split();chunks=[' '.join(words[i:i+17]) for i in range(0,len(words),17)]
 for i,chunk in enumerate(chunks):
  subtitles.append(f'{len(subtitles)+1}\n{stamp(timeline+i*seconds/len(chunks))} --> {stamp(timeline+(i+1)*seconds/len(chunks))}\n'+ '\n'.join(textwrap.wrap(chunk,65))+'\n')
 timeline+=seconds;outputs.append(output)
 sources[str(raw)]=hashlib.file_digest(raw.open('rb'),'sha256').hexdigest()
 audio.append({'section':name,'sourceVoice':'macOS Samantha, computer-generated','speechSeconds':round(speech,3),'fitSpeed':round(speed,4)})
 print('Packaged recorded section: '+name,flush=True)
srt=media/'SIMULATED_monad_walkthrough_3m50s.srt';srt.write_text('\n'.join(subtitles))
listing=work/'concat.txt';listing.write_text('\n'.join("file '"+str(p.resolve())+"'" for p in outputs)+'\n')
video=media/'SIMULATED_monad_walkthrough_3m50s.mp4'
subprocess.run(['ffmpeg','-y','-v','warning','-f','concat','-safe','0','-i',str(listing),'-i',str(srt),'-map','0:v','-map','0:a','-map','1:0','-c:v','copy','-c:a','copy','-c:s','mov_text','-disposition:s:0','default','-metadata','title=SIMULATED Ortalama Monad engineering walkthrough; owner hosting and physical phone pending','-movflags','+faststart',str(video)],check=True)
short=media/'SIMULATED_monad_preview_20s.mp4';gif=short.with_suffix('.gif')
subprocess.run(['ffmpeg','-y','-v','warning','-ss','10','-i',str(work/'close.mp4'),'-i',str(work/'attacks.mp4'),'-filter_complex','[0:v]trim=duration=10,setpts=PTS-STARTPTS,scale=960:600,fps=10[a];[1:v]trim=duration=10,setpts=PTS-STARTPTS,scale=960:600,fps=10[b];[a][b]concat=n=2:v=1:a=0[v]','-map','[v]','-an','-t','20','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',str(short)],check=True)
subprocess.run(['ffmpeg','-y','-v','warning','-i',str(short),'-filter_complex','[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',str(gif)],check=True)
assert 229.8<=duration(video)<=230.2
assert 19.8<=duration(short)<=20.2
record={'simulation':True,'status':'RECORDED_ENGINEERING_WALKTHROUGH','seconds':duration(video),'previewSeconds':duration(short),'chainId':10143,'sourceSHA256':sources,'outputSHA256':{str(p):hashlib.file_digest(p.open('rb'),'sha256').hexdigest() for p in [video,srt,short,gif]},'narration':audio,'scope':plan['scope'],'editing':'Individual real UI clips trimmed to stated section durations, no fabricated protocol result. Earlier real close is explicitly captioned. Attack segment rechecks previously mined receipts and sends no new transaction. Preview is 10 seconds from the close and 10 from the receipt recheck.','physicalPhoneTest':False,'publicHostingTest':False,'finalPublicPhoneSubmissionVideoComplete':False}
(media/'SIMULATED_monad_walkthrough_recording.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'seconds':record['seconds'],'video':str(video),'preview':str(gif)}))
