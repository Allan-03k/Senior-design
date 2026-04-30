"""
API 测试脚本 - 验证烹饪指南功能
"""
import requests
import json
import time

BASE_URL = "http://localhost:5000"

def test_health():
    """测试健康检查"""
    print("📊 测试健康检查...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"✅ 状态: {response.json()}")
        return True
    except Exception as e:
        print(f"❌ 失败: {e}")
        return False

def test_cooking_guide():
    """测试烹饪指南生成"""
    print("\n🎬 测试烹饪指南生成...")

    payload = {
        "recipe_name": "番茄炒蛋",
        "ingredients": ["番茄", "鸡蛋", "盐", "油"],
        "steps": ["打蛋", "炒番茄", "混合", "调味"]
    }

    try:
        response = requests.post(
            f"{BASE_URL}/api/generate-cooking-guide",
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ 烹饪指南生成成功！")
                print(f"   - 总耗时: {data['enhanced_steps']['total_time_minutes']} 分钟")
                print(f"   - 难度: {data['enhanced_steps']['difficulty']}")
                print(f"   - 步骤数: {len(data['enhanced_steps']['steps'])}")
                print(f"   - 视频 URL: {data['video_url']}")
                return True
            else:
                print(f"❌ API 错误: {data.get('error')}")
                return False
        else:
            print(f"❌ HTTP {response.status_code}: {response.text}")
            return False

    except requests.exceptions.Timeout:
        print("⏱️ 请求超时（这很正常，视频生成需要时间）")
        print("💡 提示: 检查 Docker 容器是否正在运行: docker ps")
        return False
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def main():
    print("=" * 50)
    print("🍳 SmartEats 烹饪指南功能测试")
    print("=" * 50)

    print("\n⏳ 等待服务启动（最多30秒）...")
    for i in range(30):
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=1)
            if response.status_code == 200:
                print(f"✅ 服务已启动！")
                break
        except:
            pass
        time.sleep(1)
        if i % 5 == 0 and i > 0:
            print(f"  ... {i}s")
    else:
        print("❌ 服务启动超时")
        print("\n💡 排查步骤:")
        print("1. 检查 Docker 是否运行: docker ps")
        print("2. 查看日志: docker logs smarteats-backend")
        print("3. 确保 5000 端口未被占用")
        return

    # 运行测试
    results = []
    results.append(("健康检查", test_health()))
    results.append(("烹饪指南生成", test_cooking_guide()))

    # 总结
    print("\n" + "=" * 50)
    print("📋 测试总结")
    print("=" * 50)
    for test_name, passed in results:
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"{status}: {test_name}")

    passed_count = sum(1 for _, p in results if p)
    total_count = len(results)
    print(f"\n总体: {passed_count}/{total_count} 测试通过")

    if passed_count == total_count:
        print("\n🎉 所有测试通过！烹饪指南功能已就绪。")
    else:
        print("\n⚠️  请检查失败的测试")

if __name__ == "__main__":
    main()
