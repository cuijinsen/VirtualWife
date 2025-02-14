import * as THREE from "three";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { VRMAnimation } from "../../lib/VRMAnimation/VRMAnimation";
import { VRMLookAtSmootherLoaderPlugin } from "@/lib/VRMLookAtSmootherLoaderPlugin/VRMLookAtSmootherLoaderPlugin";
import { LipSync } from "../lipSync/lipSync";
import { EmoteController } from "../emoteController/emoteController";
import { Screenplay, EmotionType } from "../messages/messages";
import { loadMixamoAnimation } from "../mixamo/loadMixamoAnimation";
import { buildUrl } from "@/utils/buildUrl";

/**
 * 3Dキャラクターを管理するクラス
 */
export class Model {
  public vrm?: VRM | null;
  public mixer?: THREE.AnimationMixer;
  public emoteController?: EmoteController;
  public clipMap: Map<string, THREE.AnimationClip> = new Map();
  public blendTime: number = 0.5; // 这是混合时间，可以根据需要调整



  private _lookAtTargetParent: THREE.Object3D;
  private _lipSync?: LipSync;
 
  private _current_clipMap: Map<string, THREE.AnimationClip> = new Map();



 
  constructor(lookAtTargetParent: THREE.Object3D) {
    this._lookAtTargetParent = lookAtTargetParent;
    this._lipSync = new LipSync(new AudioContext());
  }

  public async loadVRM(url: string): Promise<void> {
    const loader = new GLTFLoader();
    loader.register(
      (parser) =>
        new VRMLoaderPlugin(parser, {
          lookAtPlugin: new VRMLookAtSmootherLoaderPlugin(parser),
        })
    );

    const gltf = await loader.loadAsync(url);

    const vrm = (this.vrm = gltf.userData.vrm);
    vrm.scene.name = "VRMRoot";

    VRMUtils.rotateVRM0(vrm);
    this.mixer = new THREE.AnimationMixer(vrm.scene);

    this.emoteController = new EmoteController(vrm, this._lookAtTargetParent);

   }

  public unLoadVrm() {
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
    }
  }

  /**
   * VRMアニメーションを読み込む
   *
   * https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm_animation-1.0/README.ja.md
   */
  public async loadAnimation(vrmAnimation: VRMAnimation): Promise<void> {
    const { vrm, mixer } = this;
    if (vrm == null || mixer == null) {
      throw new Error("You have to load VRM first");
    }

    const clip = vrmAnimation.createAnimationClip(vrm);
    const action = mixer.clipAction(clip);
    action.play();
  }

  // mixamo animation
  public async loadFBX( animationUrl:string ) {
    const { vrm, mixer, clipMap, _current_clipMap,blendTime } = this;

    const animationClip = clipMap.get(animationUrl)
    const currentClip = _current_clipMap.get("current")
    if (vrm == null || mixer == null || animationClip == null) {
      throw new Error("You have to load VRM first");
    }

    _current_clipMap?.set("current",animationClip)

    if(currentClip != null){
      // 创建动画动作
      // const currentClipAction = mixer.clipAction(currentClip);
      // const nextClipAction = mixer.clipAction(animationClip);

      // 设置初始权重
      // currentClipAction.setEffectiveWeight(1.0);
      // nextClipAction.setEffectiveWeight(0.0);

      // // 切换动画
      // currentClipAction.crossFadeTo(nextClipAction, blendTime, true);
      // currentClipAction.stop();
      // nextClipAction.play();

      mixer.clipAction(currentClip)?.stop();
      mixer.clipAction(animationClip)?.play();
    }else{
      mixer.clipAction(animationClip)?.play();
    }

 

   
    
  }

  /**
   * 音声を再生し、リップシンクを行う
   */
  public async speak(buffer: ArrayBuffer, screenplay: Screenplay) {
    this.emoteController?.playEmotion(screenplay.expression);
    await new Promise((resolve) => {
      this._lipSync?.playFromArrayBuffer(buffer, () => {
        resolve(true);
        this.emoteController?.playEmotion("neutral" as EmotionType);
      });
    });
  }

  public async emote(emotionType: EmotionType) {
    this.emoteController?.playEmotion(emotionType);
  }

  public update(delta: number): void {
    if (this._lipSync) {
      const { volume } = this._lipSync.update();
      this.emoteController?.lipSync("aa", volume);
    }

    this.emoteController?.update(delta);
    this.mixer?.update(delta);
    this.vrm?.update(delta);
  }
}
