from setuptools import setup, find_packages

setup(
    name="mediabasket-connector",
    version="0.1.0",
    description="SDK for building MediaBasket connectors",
    packages=find_packages(),
    python_requires=">=3.11",
    install_requires=["httpx>=0.27.0"],
    entry_points={},
)
